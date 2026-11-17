import { CircleAlertIcon } from "lucide-react";
import type { Host, Session } from "../api/port";
import { Badge } from "./ui/badge";

export const HostStateBadge = ({ state }: { state: Host["state"] }) => {
  if (state === "Online") return <Badge variant="success">Online</Badge>;
  if (state === "Offline")
    return (
      <Badge variant="destructive">
        <CircleAlertIcon aria-hidden />
        Offline
      </Badge>
    );
  if (state === "Revoked") return <Badge variant="grey">Revoked</Badge>;
  return <Badge variant="outline">Enrolled</Badge>;
};

export const SessionStateBadge = ({ state }: { state: Session["state"] }) => {
  if (state === "Running") return <Badge variant="primary">Running</Badge>;
  if (state === "Stopping") return <Badge variant="warning">Stopping</Badge>;
  if (state === "Archived") return <Badge variant="grey">Archived</Badge>;
  if (state === "Failed")
    return (
      <Badge variant="destructive">
        <CircleAlertIcon aria-hidden />
        Failed
      </Badge>
    );
  return <Badge variant="outline">{state}</Badge>;
};
