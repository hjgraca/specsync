import { describe, it } from "vitest";
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
  it("creates a Lightsail container service named specsync", () => {
    const template = createTemplate();

    template.hasResourceProperties("AWS::Lightsail::Container", {
      ServiceName: "specsync",
    });
  }, 15_000);

  it("configures nano power with scale 1", () => {
    const template = createTemplate();

    template.hasResourceProperties("AWS::Lightsail::Container", {
      Power: "nano",
      Scale: 1,
    });
  });

  it("enables ECR image puller role for private registry access", () => {
    const template = createTemplate();

    template.hasResourceProperties("AWS::Lightsail::Container", {
      PrivateRegistryAccess: {
        EcrImagePullerRole: {
          IsActive: true,
        },
      },
    });
  });

  it("deploys a container exposing port 4000 over HTTP", () => {
    const template = createTemplate();

    template.hasResourceProperties("AWS::Lightsail::Container", {
      ContainerServiceDeployment: {
        Containers: Match.arrayWith([
          Match.objectLike({
            ContainerName: "specsync-app",
            Ports: [{ Port: "4000", Protocol: "HTTP" }],
          }),
        ]),
      },
    });
  });

  it("sets required environment variables", () => {
    const template = createTemplate();

    template.hasResourceProperties("AWS::Lightsail::Container", {
      ContainerServiceDeployment: {
        Containers: Match.arrayWith([
          Match.objectLike({
            Environment: Match.arrayWith([
              { Variable: "PORT", Value: "4000" },
              { Variable: "HOST", Value: "0.0.0.0" },
              { Variable: "REVIEW_TOOL_DB_PATH", Value: "/data/specsync.db" },
            ]),
          }),
        ]),
      },
    });
  });

  it("configures public endpoint on port 4000 with health check", () => {
    const template = createTemplate();

    template.hasResourceProperties("AWS::Lightsail::Container", {
      ContainerServiceDeployment: {
        PublicEndpoint: {
          ContainerName: "specsync-app",
          ContainerPort: 4000,
          HealthCheckConfig: Match.objectLike({
            Path: "/health",
            SuccessCodes: "200-399",
          }),
        },
      },
    });
  });

  it("outputs the service URL", () => {
    const template = createTemplate();

    template.hasOutput("Url", {
      Description: "Specsync URL",
    });
  });

  it("creates exactly one Lightsail container service", () => {
    const template = createTemplate();

    template.resourceCountIs("AWS::Lightsail::Container", 1);
  });
});
