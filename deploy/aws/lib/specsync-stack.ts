import * as cdk from "aws-cdk-lib";
import * as apprunner from "aws-cdk-lib/aws-apprunner";
import * as ecr_assets from "aws-cdk-lib/aws-ecr-assets";
import * as iam from "aws-cdk-lib/aws-iam";
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

    const accessRole = new iam.Role(this, "AccessRole", {
      assumedBy: new iam.ServicePrincipal("build.apprunner.amazonaws.com"),
    });
    imageAsset.repository.grantPull(accessRole);

    const service = new apprunner.CfnService(this, "Service", {
      serviceName: "specsync",
      sourceConfiguration: {
        authenticationConfiguration: {
          accessRoleArn: accessRole.roleArn,
        },
        imageRepository: {
          imageIdentifier: imageAsset.imageUri,
          imageRepositoryType: "ECR",
          imageConfiguration: {
            port: "4000",
            runtimeEnvironmentVariables: [
              { name: "PORT", value: "4000" },
              { name: "HOST", value: "0.0.0.0" },
              { name: "REVIEW_TOOL_DB_PATH", value: "/data/specsync.db" },
            ],
          },
        },
      },
      instanceConfiguration: {
        cpu: "0.25 vCPU",
        memory: "0.5 GB",
      },
    });

    new cdk.CfnOutput(this, "Url", {
      value: `https://${service.attrServiceUrl}`,
      description: "Specsync URL",
    });
  }
}
