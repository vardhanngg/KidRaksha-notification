import ResetPasswordForm from "./ResetPasswordForm";

export default async function ResetPasswordPage({ searchParams }: { searchParams?: Promise<{ token?: string }> }) {
  const params = await searchParams;
  const token = typeof params?.token === "string" ? params.token : "";
  return <ResetPasswordForm token={token} />;
}
