"use client";
import { Button } from "@/components/ui/button";
import { useTRPC } from "@/trpc/client";

import { useMutation } from "@tanstack/react-query";


const Page = () => {
  const trpc = useTRPC();
  const invoke  = useMutation(trpc.invoke.mutationOptions({}));
  return (
    <div>
      <h1>Hello World</h1>
      <Button onClick={() => invoke.mutate({ text: 'client' })}>Invoke</Button>
    </div>
  );
};

export default Page;