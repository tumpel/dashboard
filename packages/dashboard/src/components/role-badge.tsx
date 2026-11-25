import type { Member } from "../api/port";
import { UNRECOGNISED_LABEL } from "../api/wording";
import { Badge } from "./ui/badge";

export const RoleBadge = ({ role }: { role: Member["role"] }) => (
  <Badge variant={role === "Owner" ? "primary" : "outline"}>
    {role === "Unrecognised" ? UNRECOGNISED_LABEL : role}
  </Badge>
);
