#!/bin/bash

# Function to show usage
show_usage() {
    echo "Usage: ./switch-env.sh [vyve|denominator]"
    echo "  vyve        - Switch to Vyve environment"
    echo "  denominator - Switch to Denominator environment"
}

# Check if an argument was provided
if [ $# -eq 0 ]; then
    show_usage
    exit 1
fi

# Get the environment name
ENV_NAME=$1

# Validate environment name
if [ "$ENV_NAME" != "vyve" ] && [ "$ENV_NAME" != "denominator" ]; then
    echo "Error: Invalid environment name"
    show_usage
    exit 1
fi

# Copy the appropriate environment file
echo "Switching to $ENV_NAME environment..."
cp ".env.$ENV_NAME" .env

# Make the script executable
chmod +x switch-env.sh

echo "Environment switched to $ENV_NAME"
echo "Please restart your application for changes to take effect" 