provider "aws" {
  region = var.aws_region
  default_tags {
    tags = merge(var.tags, { Environment = var.environment })
  }
}

locals {
  name_prefix = "eu-ai-act-${var.environment}"
}
