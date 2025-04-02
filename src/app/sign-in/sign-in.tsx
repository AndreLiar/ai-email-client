//src/app/sign-in/sign-in.tsx
import { SignIn } from "@clerk/nextjs";

export default function Page() {
  return <SignIn afterSignInUrl="/emails" />;
}
