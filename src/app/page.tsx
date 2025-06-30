"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTRPC } from "@/trpc/client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";


const Page = () => {

  const [value, setValue] = useState("");
  const trpc = useTRPC();

  const { data: messages } = useQuery(trpc.messages.getMany.queryOptions());

  const createMessage  = useMutation(trpc.messages.createMessage.mutationOptions({
    onSuccess: () => {
      toast.success("Message created");
    },
  }));

  return (
    <div className="flex flex-col gap-4 items-center justify-center h-screen">
      <Input value={value} onChange={(e) => setValue(e.target.value)} />
      <Button disabled={createMessage.isPending} onClick={() => createMessage.mutate({ value: value })}>Create Message</Button>

      {JSON.stringify(messages, null, 2)}
    </div>
  );
};

export default Page;