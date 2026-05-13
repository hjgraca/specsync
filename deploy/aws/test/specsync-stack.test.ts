import { describe, it, expect } from "vitest";
import * as cdk from "aws-cdk-lib";
import { Template, Match } from "aws-cdk-lib/assertions";
import { SpecsyncStack } from "../lib/specsync-stack.js";

function createTemplate(): Template {
  const app = new cdk.App();
  const stack = new SpecsyncStack(app, "TestStack", {
    env: { account: "123456789012", region: "us-east-1" },
  });
  return Template.fromStack(stack);
}

describe("SpecsyncStack", () => {
  it("creates an App Runner service named specsync", () => {
    const template = createTemplate();

    template.hasResourceProperties("AWS::AppRunner::Service", {
      ServiceName: "specsync",
    });
  });

  it("configures port 4000", () => {
    const template = createTemplate();

    template.hasResourceProperties("AWS::AppRunner::Service", {
      SourceConfiguration: {
        ImageRepository: {
          ImageConfiguration: {
            Port: "4000",
          },
        },
      },
    });
  });

  it("sets required environment variables", () => {
    const template = createTemplate();

    template.hasResourceProperties("AWS::AppRunner::Service", {
      SourceConfiguration: {
        ImageRepository: {
          ImageConfiguration: {
            RuntimeEnvironmentVariables: Match.arrayWith([
              { Name: "PORT", Value: "4000" },
              { Name: "HOST", Value: "0.0.0.0" },
              { Name: "REVIEW_TOOL_DB_PATH", Value: "/data/specsync.db" },
            ]),
          },
        },
      },
    });
  });

  it("uses ECR as image repository type", () => {
    const template = createTemplate();

    template.hasResourceProperties("AWS::AppRunner::Service", {
      SourceConfiguration: {
        ImageRepository: {
          ImageRepositoryType: "ECR",
        },
      },
    });
  });

  it("configures 0.25 vCPU and 0.5 GB memory", () => {
    const template = createTemplate();

    template.hasResourceProperties("AWS::AppRunner::Service", {
      InstanceConfiguration: {
        Cpu: "0.25 vCPU",
        Memory: "0.5 GB",
      },
    });
  });

  it("creates an IAM role for App Runner to pull from ECR", () => {
    const template = createTemplate();

    template.hasResourceProperties("AWS::IAM::Role", {
      AssumeRolePolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: "sts:AssumeRole",
            Effect: "Allow",
            Principal: {
              Service: "build.apprunner.amazonaws.com",
            },
          }),
        ]),
      },
    });
  });

  it("grants ECR pull permissions to the access role", () => {
    const template = createTemplate();

    template.hasResourceProperties("AWS::IAM::Policy", {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: Match.arrayWith([
              "ecr:BatchCheckLayerAvailability",
              "ecr:GetDownloadUrlForLayer",
              "ecr:BatchGetImage",
            ]),
            Effect: "Allow",
          }),
        ]),
      },
    });
  });

  it("outputs the service URL", () => {
    const template = createTemplate();

    template.hasOutput("Url", {
      Description: "Specsync URL",
    });
  });

  it("creates exactly one App Runner service", () => {
    const template = createTemplate();

    template.resourceCountIs("AWS::AppRunner::Service", 1);
  });

  it("wires the access role ARN into the service auth config", () => {
    const template = createTemplate();

    template.hasResourceProperties("AWS::AppRunner::Service", {
      SourceConfiguration: {
        AuthenticationConfiguration: {
          AccessRoleArn: Match.anyValue(),
        },
      },
    });
  });
});
