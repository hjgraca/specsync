import * as cdk from "aws-cdk-lib";
import * as lightsail from "aws-cdk-lib/aws-lightsail";
import * as ecr_assets from "aws-cdk-lib/aws-ecr-assets";
import { Construct } from "constructs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export class SpecsyncStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const imageAsset = new ecr_assets.DockerImageAsset(this, "Image", {
      directory: resolve(__dirname, "../../.."),
      file: "Dockerfile",
      platform: ecr_assets.Platform.LINUX_AMD64,
      exclude: ["deploy"],
    });

    const containerService = new lightsail.CfnContainer(this, "Service", {
      serviceName: "specsync",
      power: "nano",
      scale: 1,
      privateRegistryAccess: {
        ecrImagePullerRole: {
          isActive: true,
        },
      },
      containerServiceDeployment: {
        containers: [
          {
            containerName: "specsync-app",
            image: imageAsset.imageUri,
            ports: [{ port: "4000", protocol: "HTTP" }],
            environment: [
              { variable: "PORT", value: "4000" },
              { variable: "HOST", value: "0.0.0.0" },
              { variable: "REVIEW_TOOL_DB_PATH", value: "/data/specsync.db" },
            ],
          },
        ],
        publicEndpoint: {
          containerName: "specsync-app",
          containerPort: 4000,
          healthCheckConfig: {
            healthyThreshold: 2,
            unhealthyThreshold: 3,
            intervalSeconds: 30,
            timeoutSeconds: 5,
            path: "/health",
            successCodes: "200-399",
          },
        },
      },
    });

    new cdk.CfnOutput(this, "Url", {
      value: containerService.attrUrl,
      description: "Specsync URL",
    });
  }
}
