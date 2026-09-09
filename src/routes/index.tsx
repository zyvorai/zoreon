import { createFileRoute } from "@tanstack/react-router";
import { Desktop } from "@/components/desktop/desktop";
import { RedirectToSignIn, SignedIn, SignedOut } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const { isPending } = useCurrentUserState();

  if (isPending) {
    return (
      <div className="grid h-dvh place-items-center bg-[#f5f5f7]">
        <div
          className="size-8 animate-spin rounded-full border-2 border-[#0071e3] border-t-transparent"
          aria-label="Loading"
        />
      </div>
    );
  }

  return (
    <>
      <SignedIn>
        <Desktop />
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn to="/login" />
      </SignedOut>
    </>
  );
}
