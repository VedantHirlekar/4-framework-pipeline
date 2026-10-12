pipeline {
    agent any

    parameters {
        choice(
            name: 'ACTION',
            choices: ['deploy', 'rollback'],
            description: 'Choose deployment or manual rollback'
        )

        string(
            name: 'ROLLBACK_TAG',
            defaultValue: '',
            description: 'Previous image tag for manual rollback, e.g. build-9'
        )
    }

    environment {
        AWS_REGION = 'ap-southeast-2'
        AWS_ACCOUNT_ID = '621996700521'
        ECR_URL = '621996700521.dkr.ecr.ap-southeast-2.amazonaws.com'
        INSTANCE_ID = 'i-0a963f6ab1fca3e3e'
        IMAGE_TAG = "build-${BUILD_NUMBER}"
    }

    stages {

        // =====================================================
        // STAGE 1: CHECKOUT CODE
        // =====================================================

        stage('Checkout Code') {
            when {
                expression {
                    params.ACTION == 'deploy'
                }
            }

            steps {
                git branch: 'main',
                    url: 'https://github.com/VedantHirlekar/4-framework-pipeline.git'
            }
        }

        // =====================================================
        // STAGE 2: BUILD DOCKER IMAGES
        // =====================================================

        stage('Build Docker Images') {
            when {
                expression {
                    params.ACTION == 'deploy'
                }
            }

            steps {
                sh '''
                    set -e

                    echo "Building Express..."
                    docker build -t employee-express:$IMAGE_TAG ./express

                    echo "Building FastAPI..."
                    docker build -t employee-fastapi:$IMAGE_TAG ./fastapi

                    echo "Building Spring Boot..."
                    docker build -t employee-springboot:$IMAGE_TAG ./springboot

                    echo "Building .NET..."
                    docker build -t employee-dotnet:$IMAGE_TAG ./dotnet

                    echo "Building NGINX..."
                    docker build -t employee-nginx:$IMAGE_TAG ./nginx

                    echo "All Docker images built successfully."
                '''
            }
        }

        // =====================================================
        // STAGE 3: LOGIN TO ECR
        // =====================================================

        stage('Login to ECR') {
            when {
                expression {
                    params.ACTION == 'deploy'
                }
            }

            steps {
                sh '''
                    set -e

                    aws ecr get-login-password \
                        --region "$AWS_REGION" |
                    docker login \
                        --username AWS \
                        --password-stdin "$ECR_URL"
                '''
            }
        }

        // =====================================================
        // STAGE 4: TAG AND PUSH IMAGES
        // =====================================================

        stage('Tag and Push Images') {
            when {
                expression {
                    params.ACTION == 'deploy'
                }
            }

            steps {
                sh '''
                    set -e

                    for service in \
                        employee-express \
                        employee-fastapi \
                        employee-springboot \
                        employee-dotnet \
                        employee-nginx
                    do
                        echo "Tagging $service:$IMAGE_TAG"

                        docker tag \
                            "$service:$IMAGE_TAG" \
                            "$ECR_URL/$service:$IMAGE_TAG"

                        echo "Pushing $service:$IMAGE_TAG"

                        docker push "$ECR_URL/$service:$IMAGE_TAG"
                    done

                    echo "All images pushed to ECR."
                '''
            }
        }

        // =====================================================
        // STAGE 5: DEPLOY OR MANUAL ROLLBACK
        // AUTOMATIC ROLLBACK IS INCLUDED
        // =====================================================

        stage('Deploy / Rollback with Health Checks') {

            steps {
                script {

                    // -----------------------------------------
                    // Validate the requested action
                    // -----------------------------------------

                    if (params.ACTION == 'deploy') {

                        env.TARGET_TAG = env.IMAGE_TAG

                    } else if (params.ACTION == 'rollback') {

                        if (!(params.ROLLBACK_TAG ==~ /build-[0-9]+/)) {
                            error(
                                'Invalid ROLLBACK_TAG. ' +
                                'Use a tag such as build-9.'
                            )
                        }

                        env.TARGET_TAG = params.ROLLBACK_TAG.trim()

                    } else {

                        error('Unsupported ACTION.')

                    }

                    echo "Requested action: ${params.ACTION}"
                    echo "Target image tag: ${env.TARGET_TAG}"

                    // -----------------------------------------
                    // Create remote deployment script
                    // -----------------------------------------

                    def remoteScript = '''#!/bin/bash

set -Eeuo pipefail

AWS_REGION="ap-southeast-2"
ECR_URL="621996700521.dkr.ecr.ap-southeast-2.amazonaws.com"

TARGET_TAG="__TARGET_TAG__"
ACTION="__ACTION__"

APP_DIR="/home/ssm-user/4-framework-pipeline"
TAG_FILE="$APP_DIR/.last_successful_image_tag"

cd "$APP_DIR"

# ---------------------------------------------------------
# STEP 1: Identify the previously deployed version
# ---------------------------------------------------------

echo "=========================================="
echo "Deployment action: $ACTION"
echo "Target version: $TARGET_TAG"
echo "=========================================="

PREVIOUS_TAG=""

CURRENT_CONTAINER=$(docker compose ps -q express || true)

if [ -n "$CURRENT_CONTAINER" ]; then

    CURRENT_IMAGE=$(docker inspect \
        --format '{{.Config.Image}}' \
        "$CURRENT_CONTAINER")

    CANDIDATE_TAG="${CURRENT_IMAGE##*:}"

    if [[ "$CANDIDATE_TAG" =~ ^build-[0-9]+$ ]]; then
        PREVIOUS_TAG="$CANDIDATE_TAG"
    fi

fi

# Use the saved successful deployment tag if necessary.

if [ -z "$PREVIOUS_TAG" ] && [ -f "$TAG_FILE" ]; then

    CANDIDATE_TAG=$(cat "$TAG_FILE")

    if [[ "$CANDIDATE_TAG" =~ ^build-[0-9]+$ ]]; then
        PREVIOUS_TAG="$CANDIDATE_TAG"
    fi

fi

if [[ ! "$PREVIOUS_TAG" =~ ^build-[0-9]+$ ]]; then

    echo "ERROR: Previous deployed version could not be identified."
    echo "Cannot safely guarantee automatic rollback."

    exit 1

fi

echo "Previous version: $PREVIOUS_TAG"
echo "Requested version: $TARGET_TAG"

# ---------------------------------------------------------
# STEP 2: ECR LOGIN
# ---------------------------------------------------------

aws ecr get-login-password \
    --region "$AWS_REGION" |
docker login \
    --username AWS \
    --password-stdin "$ECR_URL"

# ---------------------------------------------------------
# STEP 3: HEALTH CHECK FUNCTION
# ---------------------------------------------------------

check_health() {

    local paths=(
        "/api/v1/implementations/express/health"
        "/api/v1/implementations/fastapi/health"
        "/api/v1/implementations/springboot/health"
        "/api/v1/implementations/dotnet/health"
    )

    local path
    local container_id

    # Check application health through local NGINX.

    for path in "${paths[@]}"; do

        echo "Checking endpoint: $path"

        if ! curl \
            --fail \
            --silent \
            --show-error \
            --max-time 5 \
            "http://127.0.0.1$path"; then

            echo "FAILED: $path"

            return 1

        fi

        echo
        echo "PASSED: $path"

    done

    # Check that every expected container is running.

    for service in \
        express \
        fastapi \
        springboot \
        dotnet \
        nginx
    do

        container_id=$(docker compose ps -q "$service")

        if [ -z "$container_id" ]; then

            echo "FAILED: Container missing: $service"

            return 1

        fi

        if [ "$(docker inspect \
            --format '{{.State.Running}}' \
            "$container_id")" != "true" ]; then

            echo "FAILED: Container not running: $service"

            return 1

        fi

    done

    echo "All application health checks passed."

    return 0
}

# ---------------------------------------------------------
# STEP 4: WAIT FOR APPLICATION HEALTH
# ---------------------------------------------------------

wait_for_health() {

    local attempt

    for attempt in $(seq 1 12); do

        echo "Health check attempt: $attempt/12"

        if check_health; then
            return 0
        fi

        echo "Application not healthy yet."
        sleep 10

    done

    return 1
}

# ---------------------------------------------------------
# STEP 5: AUTOMATIC ROLLBACK FUNCTION
# ---------------------------------------------------------

rollback_to_previous() {

    local reason="$1"

    # Disable the error trap so a rollback failure does not
    # recursively invoke this function.

    trap - ERR

    echo "=========================================="
    echo "ROLLBACK STARTED"
    echo "Reason: $reason"
    echo "Restoring: $PREVIOUS_TAG"
    echo "=========================================="

    export IMAGE_TAG="$PREVIOUS_TAG"

    # Pull the previous version.

    if ! docker compose pull \
        express \
        fastapi \
        springboot \
        dotnet \
        nginx; then

        echo "CRITICAL: Failed to pull previous images."
        echo "Manual investigation required."

        exit 2

    fi

    # Restore the previous application version.

    if ! docker compose up -d --no-build \
        express \
        fastapi \
        springboot \
        dotnet \
        nginx; then

        echo "CRITICAL: Failed to restore previous containers."
        echo "Manual investigation required."

        exit 2

    fi

    # Verify the restored version.

    if wait_for_health; then

        printf '%s\\n' "$PREVIOUS_TAG" > "$TAG_FILE.tmp"
        mv "$TAG_FILE.tmp" "$TAG_FILE"

        echo "=========================================="
        echo "ROLLBACK SUCCESSFUL"
        echo "Restored version: $PREVIOUS_TAG"
        echo "=========================================="

        # Exit nonzero because the requested deployment failed.

        exit 1

    else

        echo "=========================================="
        echo "CRITICAL: ROLLBACK HEALTH CHECKS FAILED"
        echo "Attempted version: $PREVIOUS_TAG"
        echo "Manual investigation required."
        echo "=========================================="

        exit 2

    fi
}

# ---------------------------------------------------------
# STEP 6: ERROR HANDLER
# ---------------------------------------------------------

DEPLOY_STARTED=false

on_error() {

    local exit_code="$1"

    trap - ERR

    echo "An error occurred during deployment."
    echo "Exit code: $exit_code"

    if [ "$DEPLOY_STARTED" = "true" ] &&
       [[ "$PREVIOUS_TAG" =~ ^build-[0-9]+$ ]]; then

        rollback_to_previous \
            "Deployment command failed with exit code $exit_code"

    else

        echo "No application changes requiring rollback were made."
        exit "$exit_code"

    fi

}

trap 'on_error "$?"' ERR

# ---------------------------------------------------------
# STEP 7: PULL REQUESTED IMAGES
# ---------------------------------------------------------

export IMAGE_TAG="$TARGET_TAG"

echo "Pulling images for $TARGET_TAG..."

docker compose pull \
    express \
    fastapi \
    springboot \
    dotnet \
    nginx

# ---------------------------------------------------------
# STEP 8: RUN FLYWAY MIGRATIONS FOR NORMAL DEPLOYMENTS
# ---------------------------------------------------------

if [ "$ACTION" = "deploy" ]; then

    # From this point, failures will trigger an attempt
    # to restore the previous application version.

    DEPLOY_STARTED=true

    echo "Running Flyway database migrations..."

    docker compose run --rm flyway

fi

# ---------------------------------------------------------
# STEP 9: DEPLOY REQUESTED VERSION
# ---------------------------------------------------------

DEPLOY_STARTED=true

echo "Deploying version: $TARGET_TAG"

docker compose up -d --no-build \
    express \
    fastapi \
    springboot \
    dotnet \
    nginx

# ---------------------------------------------------------
# STEP 10: VERIFY REQUESTED VERSION
# ---------------------------------------------------------

if wait_for_health; then

    echo "=========================================="
    echo "HEALTH CHECKS PASSED"
    echo "Version: $TARGET_TAG"
    echo "=========================================="

    printf '%s\\n' "$TARGET_TAG" > "$TAG_FILE.tmp"
    mv "$TAG_FILE.tmp" "$TAG_FILE"

    DEPLOY_STARTED=false

    trap - ERR

    exit 0

fi

# ---------------------------------------------------------
# STEP 11: AUTOMATIC ROLLBACK ON HEALTH FAILURE
# ---------------------------------------------------------

rollback_to_previous \
    "Health checks failed for $TARGET_TAG"

'''

                    // Replace placeholders with validated values.

                    remoteScript = remoteScript
                        .replace('__TARGET_TAG__', env.TARGET_TAG)
                        .replace('__ACTION__', params.ACTION)

                    // Save the script in the Jenkins workspace.

                    writeFile(
                        file: 'remote-deploy.sh',
                        text: remoteScript
                    )

                    // Base64 encoding avoids shell quoting problems
                    // when passing the script through SSM.

                    env.REMOTE_SCRIPT_B64 = sh(
                        script: 'base64 -w 0 remote-deploy.sh',
                        returnStdout: true
                    ).trim()

                    // Build an AWS CLI parameters file.

                    def remoteCommand =
                        "printf '%s' '${env.REMOTE_SCRIPT_B64}' " +
                        "| base64 -d > /tmp/jenkins-deploy.sh " +
                        "&& chmod +x /tmp/jenkins-deploy.sh " +
                        "&& /tmp/jenkins-deploy.sh"

                    writeFile(
                        file: 'ssm-parameters.json',
                        text: groovy.json.JsonOutput.toJson([
                            commands: [remoteCommand]
                        ])
                    )
                }

                // ---------------------------------------------
                // Send command to application EC2 using SSM
                // ---------------------------------------------

                sh '''
                    set -e

                    echo "Sending deployment command through SSM..."

                    COMMAND_ID=$(aws ssm send-command \
                        --region "$AWS_REGION" \
                        --instance-ids "$INSTANCE_ID" \
                        --document-name "AWS-RunShellScript" \
                        --comment "$ACTION deployment of $TARGET_TAG" \
                        --parameters file://ssm-parameters.json \
                        --query "Command.CommandId" \
                        --output text)

                    echo "SSM Command ID: $COMMAND_ID"

                    STATUS="Pending"

                    # Wait for deployment or rollback to finish.

                    for i in $(seq 1 60); do

                        STATUS=$(aws ssm get-command-invocation \
                            --region "$AWS_REGION" \
                            --command-id "$COMMAND_ID" \
                            --instance-id "$INSTANCE_ID" \
                            --query "Status" \
                            --output text 2>/dev/null || echo "Pending")

                        echo "Remote status: $STATUS"

                        if [ "$STATUS" = "Success" ]; then
                            break
                        fi

                        if [ "$STATUS" = "Failed" ] || \
                           [ "$STATUS" = "Cancelled" ] || \
                           [ "$STATUS" = "TimedOut" ] || \
                           [ "$STATUS" = "Cancelling" ]; then

                            break

                        fi

                        sleep 10

                    done

                    # Print remote execution output.

                    echo "=========================================="
                    echo "REMOTE EXECUTION DETAILS"
                    echo "=========================================="

                    aws ssm get-command-invocation \
                        --region "$AWS_REGION" \
                        --command-id "$COMMAND_ID" \
                        --instance-id "$INSTANCE_ID" \
                        --query '{Status:Status,Output:StandardOutputContent,Error:StandardErrorContent}' \
                        --output json || true

                    if [ "$STATUS" != "Success" ]; then

                        echo "Deployment or rollback failed."
                        echo "Check the remote execution details."

                        exit 1

                    fi

                    echo "Remote operation completed successfully."
                '''
            }
        }
    }

    // =========================================================
    // POST-BUILD ACTIONS
    // =========================================================

    post {

        success {
            script {

                if (params.ACTION == 'deploy') {

                    echo """
                    ==========================================
                    DEPLOYMENT SUCCESSFUL
                    Image tag: ${env.IMAGE_TAG}
                    ==========================================
                    """

                } else {

                    echo """
                    ==========================================
                    MANUAL ROLLBACK SUCCESSFUL
                    Restored version: ${params.ROLLBACK_TAG}
                    ==========================================
                    """

                }
            }
        }

        failure {
            echo '''
            ==========================================
            PIPELINE FAILED
            ==========================================

            Possible causes:
            - Docker build or ECR push failure.
            - SSM command failure.
            - Flyway migration failure.
            - Application health-check failure.
            - Automatic rollback was attempted but failed.
            - The previous image version could not be identified.

            Check the Jenkins console output and remote SSM output.
            '''
        }

        always {
            echo "Pipeline execution finished."
        }
    }
}