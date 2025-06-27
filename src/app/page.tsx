"use client";
import { Button } from "@/components/ui/button";
import { useTRPC } from "@/trpc/client";

import { useMutation } from "@tanstack/react-query";


const Page = () => {
  const trpc = useTRPC();
  const invoke  = useMutation(trpc.invoke.mutationOptions({}));
  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <Button onClick={() => invoke.mutate({ text: 'client' })}>Invoke</Button>
    </div>
  );
};

export default Page;