import type { Role } from "../api/port";
import { Badge } from "./ui/badge";

export const RoleBadge = ({ role }: { role: Role }) => (
  <Badge variant={role === "Owner" ? "primary" : "outline"}>{role}</Badge>
);
