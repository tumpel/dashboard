import { useLocation, useNavigate } from "@tanstack/react-router";

export const useHashDialog = () => {
  const navigate = useNavigate();
  const hash = useLocation({ select: (location) => location.hash });
  return {
    hash,
    isOpen: (name: string): boolean => hash === name,
    close: () => void navigate({ to: ".", hash: "", search: (search) => search }),
  };
};
