terraform {
  required_version = ">= 1.7.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.60"
    }
  }

  backend "s3" {
    # Configured per-environment via -backend-config.
    bucket         = "REPLACE-ME-tfstate"
    key            = "eu-ai-act-classifier/terraform.tfstate"
    region         = "eu-west-1"
    dynamodb_table = "REPLACE-ME-tfstate-lock"
    encrypt        = true
  }
}
