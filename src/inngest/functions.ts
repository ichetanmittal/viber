import Sandbox from "@e2b/code-interpreter";
import { openai, createAgent } from "@inngest/agent-kit";
import { inngest } from "./client";
import { getSandbox } from "./utils";

export const helloWorld = inngest.createFunction(
  { id: "hello-world" },
  { event: "test/hello.world" },
  async ({ event,step }) => {

    const sandboxID = await step.run("get-sandbox-id", async () => {
      const sandbox = await Sandbox.create("vibe-nextjs-test-23")
        return sandbox.sandboxId
    }); 

    // Create a new agent with a system prompt (you can add optional tools, too)
    const codeAgent = createAgent({
      name: "code-agent",
      system: "You are an expert next js developer You write next js and react snippets.",
      model: openai({ model: "gpt-4o",apiKey: process.env.OPENAI_API_KEY }),
    });

    const output = await codeAgent.run(`Write the following snippet: ${event.data.value}`);

    const sandboxUrl = await step.run("get-sandbox-url", async () => {
      const sandbox = await getSandbox(sandboxID)
      const host = sandbox.getHost(3000)
      return `https://${host}`
    });

    return { output, sandboxUrl};
  },
);
