export default function PendingPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="card max-w-md space-y-3">
        <h1 className="text-lg font-semibold">Waiting for approval</h1>
        <p className="text-sm text-gray-600">
          Your account was created. An administrator needs to give you a role (consultant or reviewer) before you can use the app.
        </p>
        <form action="/auth/signout" method="post">
          <button className="btn-secondary">Sign out</button>
        </form>
      </div>
    </main>
  );
}
