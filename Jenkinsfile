pipeline {
    agent any

    parameters {
        choice(
            name: 'ACTION',
            choices: ['deploy', 'rollback'],
            description: 'Choose deployment or rollback'
        )

        string(
            name: 'ROLLBACK_TAG',
            defaultValue: '',
            description: 'Enter the previous image tag for rollback'
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

        stage('Checkout Code') {
            when {
                expression { params.ACTION == 'deploy' }
            }
            steps {
                git branch: 'main',
                    url: 'https://github.com/VedantHirlekar/4-framework-pipeline.git'
            }
        }

        stage('Build Docker Images') {
            when {
                expression { params.ACTION == 'deploy' }
            }
            steps {
                sh '''
                    set -e

                    docker build -t employee-express:$IMAGE_TAG ./express
                    docker build -t employee-fastapi:$IMAGE_TAG ./fastapi
                    docker build -t employee-springboot:$IMAGE_TAG ./springboot
                    docker build -t employee-dotnet:$IMAGE_TAG ./dotnet
                    docker build -t employee-nginx:$IMAGE_TAG ./nginx
                '''
            }
        }

        stage('Login to ECR') {
            steps {
                sh '''
                    aws ecr get-login-password --region $AWS_REGION |
                    docker login --username AWS --password-stdin $ECR_URL
                '''
            }
        }

        stage('Tag and Push Images') {
            when {
                expression { params.ACTION == 'deploy' }
            }
            steps {
                sh '''
                    set -e

                    for service in employee-express employee-fastapi employee-springboot employee-dotnet employee-nginx
                    do
                        docker tag $service:$IMAGE_TAG $ECR_URL/$service:$IMAGE_TAG
                        docker push $ECR_URL/$service:$IMAGE_TAG
                    done
                '''
            }
        }

        stage('Deploy Application') {
            when {
                expression { params.ACTION == 'deploy' }
            }
            steps {
                script {
                    deployTag = env.IMAGE_TAG
                }

                sh '''
                    set -e

                    COMMAND_ID=$(aws ssm send-command \
                        --region $AWS_REGION \
                        --instance-ids $INSTANCE_ID \
                        --document-name "AWS-RunShellScript" \
                        --comment "Deploy $IMAGE_TAG" \
                        --parameters "{\"commands\":[
                            \"set -e\",
                            \"cd /home/ssm-user/4-framework-pipeline\",
                            \"export IMAGE_TAG=$IMAGE_TAG\",
                            \"aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_URL\",
                            \"docker compose pull express fastapi springboot dotnet nginx\",
                            \"docker compose run --rm flyway\",
                            \"docker compose up -d --no-build express fastapi springboot dotnet nginx\"
                        ]}" \
                        --query "Command.CommandId" \
                        --output text)

                    echo "SSM Command ID: $COMMAND_ID"

                    for i in $(seq 1 30)
                    do
                        STATUS=$(aws ssm get-command-invocation \
                            --region $AWS_REGION \
                            --command-id "$COMMAND_ID" \
                            --instance-id "$INSTANCE_ID" \
                            --query "Status" \
                            --output text 2>/dev/null || echo "Pending")

                        echo "Deployment status: $STATUS"

                        if [ "$STATUS" = "Success" ]; then
                            break
                        fi

                        if [ "$STATUS" = "Failed" ] || \
                           [ "$STATUS" = "Cancelled" ] || \
                           [ "$STATUS" = "TimedOut" ]; then
                            aws ssm get-command-invocation \
                                --region $AWS_REGION \
                                --command-id "$COMMAND_ID" \
                                --instance-id "$INSTANCE_ID" \
                                --output json
                            exit 1
                        fi

                        sleep 10
                    done

                    if [ "$STATUS" != "Success" ]; then
                        echo "Deployment timed out."
                        exit 1
                    fi
                '''
            }
        }

        stage('Rollback') {
            when {
                expression {
                    params.ACTION == 'rollback' &&
                    params.ROLLBACK_TAG.trim() != ''
                }
            }
            steps {
                sh '''
                    set -e

                    echo "Rolling back to $ROLLBACK_TAG"

                    COMMAND_ID=$(aws ssm send-command \
                        --region $AWS_REGION \
                        --instance-ids $INSTANCE_ID \
                        --document-name "AWS-RunShellScript" \
                        --comment "Rollback to $ROLLBACK_TAG" \
                        --parameters "{\"commands\":[
                            \"set -e\",
                            \"cd /home/ssm-user/4-framework-pipeline\",
                            \"export IMAGE_TAG=$ROLLBACK_TAG\",
                            \"aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_URL\",
                            \"docker compose pull express fastapi springboot dotnet nginx\",
                            \"docker compose up -d --no-build express fastapi springboot dotnet nginx\"
                        ]}" \
                        --query "Command.CommandId" \
                        --output text)

                    echo "Rollback SSM Command ID: $COMMAND_ID"

                    for i in $(seq 1 30)
                    do
                        STATUS=$(aws ssm get-command-invocation \
                            --region $AWS_REGION \
                            --command-id "$COMMAND_ID" \
                            --instance-id "$INSTANCE_ID" \
                            --query "Status" \
                            --output text 2>/dev/null || echo "Pending")

                        echo "Rollback status: $STATUS"

                        if [ "$STATUS" = "Success" ]; then
                            break
                        fi

                        if [ "$STATUS" = "Failed" ] || \
                           [ "$STATUS" = "Cancelled" ] || \
                           [ "$STATUS" = "TimedOut" ]; then
                            aws ssm get-command-invocation \
                                --region $AWS_REGION \
                                --command-id "$COMMAND_ID" \
                                --instance-id "$INSTANCE_ID" \
                                --output json
                            exit 1
                        fi

                        sleep 10
                    done

                    if [ "$STATUS" != "Success" ]; then
                        echo "Rollback timed out."
                        exit 1
                    fi
                '''
            }
        }
    }

    post {
        success {
            echo "Pipeline completed successfully."
        }

        failure {
            echo "Pipeline failed. Check the Jenkins console output."
        }
    }
}