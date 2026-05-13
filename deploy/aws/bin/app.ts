import * as cdk from "aws-cdk-lib";
import { SpecsyncStack } from "../lib/specsync-stack.js";

const app = new cdk.App();

new SpecsyncStack(app, "SpecsyncStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || "us-east-1",
  },
});
