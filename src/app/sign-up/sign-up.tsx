//src/app/sign-up/sign-up.tsx
import { SignUp } from "@clerk/nextjs";

export default function Page() {
  return <SignUp afterSignUpUrl="/emails" />;
}
