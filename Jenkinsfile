pipeline {
    agent any

    environment {
        AWS_REGION = 'ap-southeast-2'
        AWS_ACCOUNT_ID = '621996700521'
        ECR_REGISTRY = '621996700521.dkr.ecr.ap-southeast-2.amazonaws.com'

        APP_INSTANCE_ID = 'i-0a963f6ab1fca3e3e'
    }

    stages {

        stage('Checkout') {
            steps {
                git branch: 'main',
                    url: 'https://github.com/VedantHirlekar/4-framework-pipeline.git'
            }
        }

        stage('Prepare Image Tags') {
            steps {
                script {
                    env.GIT_SHA = sh(
                        script: 'git rev-parse --short=7 HEAD',
                        returnStdout: true
                    ).trim()

                    env.IMAGE_TAG =
                        "build-${env.BUILD_NUMBER}-${env.GIT_SHA}"

                    echo "Image tag: ${env.IMAGE_TAG}"
                }
            }
        }

        stage('Build Docker Images') {
            steps {
                sh '''
                    set -eu

                    docker build -t employee-express:${IMAGE_TAG} ./express
                    docker build -t employee-fastapi:${IMAGE_TAG} ./fastapi
                    docker build -t employee-springboot:${IMAGE_TAG} ./springboot
                    docker build -t employee-dotnet:${IMAGE_TAG} ./dotnet
                    docker build -t employee-nginx:${IMAGE_TAG} ./nginx

                    echo "All five Docker images built successfully."
                '''
            }
        }

        stage('Login to Amazon ECR') {
            steps {
                sh '''
                    set -eu

                    aws ecr get-login-password \
                        --region "$AWS_REGION" |
                    docker login \
                        --username AWS \
                        --password-stdin "$ECR_REGISTRY"
                '''
            }
        }

        stage('Tag and Push Images') {
            steps {
                sh '''
                    set -eu

                    for service in express fastapi springboot dotnet nginx
                    do
                        case "$service" in
                            express)    repo="employee-express" ;;
                            fastapi)    repo="employee-fastapi" ;;
                            springboot) repo="employee-springboot" ;;
                            dotnet)     repo="employee-dotnet" ;;
                            nginx)      repo="employee-nginx" ;;
                        esac

                        docker tag \
                            "${repo}:${IMAGE_TAG}" \
                            "${ECR_REGISTRY}/${repo}:${IMAGE_TAG}"

                        docker push \
                            "${ECR_REGISTRY}/${repo}:${IMAGE_TAG}"
                    done

                    echo "All five images pushed successfully."
                '''
            }
        }

        stage('Deploy to App EC2 via SSM') {
            steps {
                script {
                    def remoteCommands = [
                        'set -eu',

                        'APP_COMPOSE=$(find /home -maxdepth 4 -type f -path "*/4-framework-pipeline/docker-compose.yml" -print -quit)',

                        'if [ -z "$APP_COMPOSE" ]; then echo "ERROR: docker-compose.yml not found under /home"; exit 1; fi',

                        'cd "$(dirname "$APP_COMPOSE")"',

                        "export IMAGE_TAG=${env.IMAGE_TAG}",

                        'echo "Authenticating Docker with Amazon ECR..."',

                        'aws ecr get-login-password --region ap-southeast-2 | docker login --username AWS --password-stdin 621996700521.dkr.ecr.ap-southeast-2.amazonaws.com',

                        'echo "Pulling application images..."',

                        'docker compose pull',

                        'echo "Running Flyway migrations..."',

                        'docker compose run --rm flyway',

                        'echo "Starting application containers..."',

                        'docker compose up -d --no-build --remove-orphans fastapi express springboot dotnet nginx',

                        'echo "Checking container status..."',

                        'docker compose ps',

                        'echo "Deployment commands completed successfully."'
                    ]

                    def parametersJson =
                        groovy.json.JsonOutput.toJson([
                            commands: remoteCommands
                        ])

                    writeFile(
                        file: 'ssm-parameters.json',
                        text: parametersJson
                    )

                    def commandId = sh(
                        script: """
                            aws ssm send-command \
                                --region '${env.AWS_REGION}' \
                                --instance-ids '${env.APP_INSTANCE_ID}' \
                                --document-name 'AWS-RunShellScript' \
                                --comment 'Deploy Employee API ${env.IMAGE_TAG}' \
                                --parameters file://ssm-parameters.json \
                                --query 'Command.CommandId' \
                                --output text
                        """,
                        returnStdout: true
                    ).trim()

                    echo "SSM deployment command ID: ${commandId}"

                    withEnv(["SSM_COMMAND_ID=${commandId}"]) {
                        sh '''
                            set -eu

                            attempt=0

                            while [ "$attempt" -lt 60 ]
                            do
                                STATUS=$(aws ssm get-command-invocation \
                                    --region "$AWS_REGION" \
                                    --command-id "$SSM_COMMAND_ID" \
                                    --instance-id "$APP_INSTANCE_ID" \
                                    --query 'Status' \
                                    --output text 2>/dev/null || true)

                                echo "Deployment status: ${STATUS:-Waiting}"

                                case "$STATUS" in

                                    Success)
                                        echo "Remote deployment succeeded."

                                        aws ssm get-command-invocation \
                                            --region "$AWS_REGION" \
                                            --command-id "$SSM_COMMAND_ID" \
                                            --instance-id "$APP_INSTANCE_ID" \
                                            --query 'StandardOutputContent' \
                                            --output text

                                        exit 0
                                        ;;

                                    Failed|Cancelled|TimedOut|DeliveryTimedOut|ExecutionTimedOut|Undeliverable|Terminated)
                                        echo "Remote deployment failed."

                                        echo "Remote standard output:"

                                        aws ssm get-command-invocation \
                                            --region "$AWS_REGION" \
                                            --command-id "$SSM_COMMAND_ID" \
                                            --instance-id "$APP_INSTANCE_ID" \
                                            --query 'StandardOutputContent' \
                                            --output text || true

                                        echo "Remote error output:"

                                        aws ssm get-command-invocation \
                                            --region "$AWS_REGION" \
                                            --command-id "$SSM_COMMAND_ID" \
                                            --instance-id "$APP_INSTANCE_ID" \
                                            --query 'StandardErrorContent' \
                                            --output text || true

                                        exit 1
                                        ;;
                                esac

                                attempt=$((attempt + 1))

                                sleep 10
                            done

                            echo "Timed out waiting for deployment status."
                            exit 1
                        '''
                    }
                }
            }
        }
    }

    post {
        success {
            echo 'SUCCESS: Images built, pushed to ECR, and deployment commands completed successfully.'
        }

        failure {
            echo 'FAILURE: Check Console Output to identify the failed stage.'
        }
    }
}