export function SetupBanner() {
  return (
    <div
      role="status"
      className="border-b border-amber-200/80 bg-amber-50 px-6 py-3 text-center text-sm text-amber-950"
    >
      <strong className="font-medium">Нужна настройка.</strong>{" "}
      Скопируйте <code className="rounded bg-amber-100/80 px-1 py-0.5 text-xs">.env.example</code>{" "}
      в <code className="rounded bg-amber-100/80 px-1 py-0.5 text-xs">.env.local</code> и укажите URL и{" "}
      <span className="whitespace-nowrap">service role</span> ключ Supabase. Затем примените миграцию из{" "}
      <code className="rounded bg-amber-100/80 px-1 py-0.5 text-xs">supabase/migrations</code>.
    </div>
  )
}
