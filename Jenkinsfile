pipeline {
    agent any

    environment {
        AWS_REGION = 'ap-southeast-2'
        AWS_ACCOUNT_ID = '621996700521'
        ECR_REGISTRY = '621996700521.dkr.ecr.ap-southeast-2.amazonaws.com'
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

                    env.IMAGE_TAG = "build-${env.BUILD_NUMBER}-${env.GIT_SHA}"

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
                    docker images
                '''
            }
        }

        stage('Login to Amazon ECR') {
            steps {
                sh '''
                    set -eu

                    aws ecr get-login-password --region "$AWS_REGION" |
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
                            express)   repo="employee-express" ;;
                            fastapi)   repo="employee-fastapi" ;;
                            springboot) repo="employee-springboot" ;;
                            dotnet)    repo="employee-dotnet" ;;
                            nginx)     repo="employee-nginx" ;;
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
    }

    post {
        success {
            echo 'SUCCESS: All five Docker images have been pushed to ECR.'
        }

        failure {
            echo 'FAILURE: Check Console Output to identify the failed stage.'
        }
    }
}