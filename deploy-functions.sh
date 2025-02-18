#!/bin/bash

# Check if project name is provided
if [ -z "$1" ]; then
    echo "Error: Project name not provided"
    echo "Usage: ./deploy-functions.sh <project-name>"
    echo "Available projects: vyve, denominator"
    exit 1
fi

# Project configurations
declare -A project_configs
project_configs[vyve_ref]="offhwhngqeoperpdesvc"
project_configs[vyve_password]="Efihebetpt93!!"
project_configs[denominator_ref]="kppitrvahxikblhcrjap"
project_configs[denominator_password]="wexcan-2fukko-xabKud"

# Get project details based on argument
project_name=$(echo "$1" | tr '[:upper:]' '[:lower:]')  # Convert to lowercase
case $project_name in
    "vyve")
        project_ref="${project_configs[vyve_ref]}"
        db_password="${project_configs[vyve_password]}"
        ;;
    "denominator")
        project_ref="${project_configs[denominator_ref]}"
        db_password="${project_configs[denominator_password]}"
        ;;
    *)
        echo "Error: Invalid project name"
        echo "Available projects: vyve, denominator"
        exit 1
        ;;
esac

# Function to deploy to a specific project
deploy_to_project() {
    local project_ref=$1
    local project_name=$2
    local db_password=$3
    
    echo "Deploying to $project_name (ref: $project_ref)..."
    
    # Set the project ref and database password
    echo "Linking project..."
    supabase link --project-ref "$project_ref" --password "$db_password"

    # Deploy the migrations
    echo "Applying migrations..."
    supabase db push --password "$db_password"

    # Deploy all edge functions
    echo "Deploying edge functions..."
    for func in supabase/functions/*/; do
        if [ -d "$func" ]; then
            func_name=$(basename "$func")
            echo "Deploying function: $func_name"
            supabase functions deploy "$func_name" --project-ref "$project_ref"
        fi
    done
    
    echo "Deployment to $project_name completed!"
    echo "----------------------------------------"
}

# Set access token
export SUPABASE_ACCESS_TOKEN=sbp_d45c54ab0f32d6edcd8ce6482b9070c42383381b

# Deploy to specified project
echo "Deploying to $project_name..."
deploy_to_project "$project_ref" "$project_name" "$db_password"

echo "Deployment completed successfully!"