import { useSyncExternalStore } from "react";
import { serviceUpdate } from "../service-update";

export const ServiceUpdateNotice = () => {
  const needed = useSyncExternalStore(serviceUpdate.subscribe, serviceUpdate.get, serviceUpdate.get);
  if (!needed) return null;
  return (
    <div role="status" className="border-b bg-card px-4 py-3">
      The service sent something this dashboard does not recognise. This dashboard likely needs an update. Reload to get
      the latest version. You can keep using the features that work.
    </div>
  );
};
