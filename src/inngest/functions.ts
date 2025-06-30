import Sandbox from "@e2b/code-interpreter";
import { openai, createAgent, createTool, createNetwork, type Tool } from "@inngest/agent-kit";
import { inngest } from "./client";
import { getSandbox, lastAssistantTextMessageContent } from "./utils";
import { z } from "zod";
import { PROMPT } from "@/prompt";
import prisma from "@/lib/db";

interface AgentState{
  summary: string;
  files: {[path: string] : string}[];
  sandboxUrl: string;
};

export const codeAgentFunction = inngest.createFunction(
  { id: "code-agent" },
  { event: "code-agent/run" },
  async ({ event,step }) => {

    const sandboxID = await step.run("get-sandbox-id", async () => {
      const sandbox = await Sandbox.create("vibe-nextjs-test-23")
        return sandbox.sandboxId
    }); 

    // Create a new agent with a system prompt (you can add optional tools, too)
    const codeAgent = createAgent<AgentState>({
      name: "code-agent",
      description: "An expert coding agent",
      system: PROMPT,
      model: openai({ model: "gpt-4.1",
        defaultParameters: {
          temperature: 0.1,
        },
        apiKey: process.env.OPENAI_API_KEY }),
      tools: [
        createTool({
          name: "terminal",
          description: "Use terminal to run commands",
          parameters: z.object({ 
            command: z.string() 
          }),
          handler: async ({ command }, { step }) => {
            return await step?.run("terminal", async () => {
              const buffers = {stdout: "", stderr: ""};

              try{
                  const sandbox = await getSandbox(sandboxID)
                  const result = await sandbox.commands.run(command,{
                  onStdout: (data: string) => {
                    buffers.stdout += data
                  },
                  onStderr: (data: string) => {
                    buffers.stderr += data
                  }
                });
                return result.stdout;
              }
              catch(e){
                console.error(
                  `Command ${command} failed with error: ${e}\n stdout: ${buffers.stdout}\n stderr: ${buffers.stderr}`
                );
                return `Command ${command} failed with error: ${e}\n stdout: ${buffers.stdout}\n stderr: ${buffers.stderr}`
              }
            });
          },
        }),
        createTool({
          name : "createorupdatefiles",
          description : "Create or update files in the sandbox",
          parameters : z.object({
            files:z.array(
              z.object({
                path : z.string(),
                content : z.string(),
              })
            )
          }),
          handler : async ({ files }, { step , network } : Tool.Options<AgentState>) => {
            const newfiles = await step?.run("createorupdatefiles", async () => {
              try {
                const updatedFiles = network.state.data.files || {};
                const sandbox = await getSandbox(sandboxID);
                for (const file of files) {
                  await sandbox.files.write(file.path,file.content);
                  updatedFiles.push({path:file.path,content:file.content});
                }
                return updatedFiles;
              } catch (e) {
                return "Error : " + e;
              }
            })
            if(typeof newfiles == "object"){
              network.state.data.files = newfiles;
            }
          }
        }),
        createTool({
          name : "readfile",
          description : "Read a file from the sandbox",
          parameters : z.object({
            files : z.array(z.string())
          }),
          handler : async ({ files }, { step }) => {
            return await step?.run("readfile", async () => {
              try {
                const sandbox = await getSandbox(sandboxID);
                const contents = [];
                for (const file of files) {
                  const content = await sandbox.files.read(file);
                  contents.push({path:file,content:content});
                }
                return JSON.stringify(contents);
              }
              catch(e){
                return "Error : " + e;
              }
            })
          }
        })
      ],
      lifecycle: {
        onResponse: async({result,network}) => {
          const lastAssistantMessageText = lastAssistantTextMessageContent(result);
          if(lastAssistantMessageText && network){
            if(lastAssistantMessageText.includes("<task_summary>")){
              network.state.data.summary = lastAssistantMessageText;
            }
          }
          return result;
        },
      },
    });

    const network = createNetwork<AgentState>({
      name: "code-agent-network",
      agents: [codeAgent],
      maxIter:15,
      router:async({ network }) => {
        const summary = network.state.data.summary;

        if(summary){
          return;
        }
        return codeAgent;
    }
  });
    
    const result = await network.run(event.data.value);

    const isError = !result.state.data.summary || Object.keys(result.state.data.files || {}).length === 0;

    const sandboxUrl = await step.run("get-sandbox-url", async () => {
      const sandbox = await getSandbox(sandboxID)
      const host = sandbox.getHost(3000)
      return `https://${host}`
    });

    await step.run("save-result", async () => {
      if(isError){
        return await prisma.message.create({
          data : {
            content : "Something went wrong, please try again ",
            role : "ASSISTANT",
            type : "ERROR",
          }
        });
      }
      return await prisma.message.create({
        data : {
          content : result.state.data.summary,
          role : "ASSISTANT",
          type : "RESULT",
          fragment:{
            create: { 
              sandboxUrl : sandboxUrl,
              title : "Fragment",
              files : result.state.data.files,
            }
          }
        }
      })
    })

    return {
      url : sandboxUrl,
      title : "Fragment",
      files : result.state.data.files,
      summary: result.state.data.summary,
    };
  },
);
