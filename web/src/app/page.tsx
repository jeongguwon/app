import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-1 flex-col px-4 pb-8 pt-8 sm:px-8 sm:pt-12">
      <section className="rounded-3xl bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-700 px-6 py-8 text-white shadow-lg sm:px-10 sm:py-12">
        <p className="text-xs font-semibold tracking-[0.18em] text-zinc-200">LOST &amp; FOUND</p>
        <h1 className="mt-3 text-2xl font-bold leading-tight sm:text-4xl">
          분실물/습득물
          <br />
          모바일 웹앱
        </h1>
        <p className="mt-4 text-sm leading-6 text-zinc-200 sm:max-w-2xl sm:text-base">
          게시글 등록, 매칭 처리, 알림 확인, 관리자 운영까지 한 화면에서 빠르게 처리할 수 있습니다.
        </p>
      </section>

      <section className="mt-5 grid gap-3 sm:mt-6 sm:grid-cols-3">
        <Link
          href="/login"
          className="rounded-xl bg-zinc-900 px-4 py-4 text-center text-sm font-semibold text-white shadow-sm transition-colors hover:bg-zinc-700"
        >
          로그인
        </Link>
        <Link
          href="/posts/new"
          className="rounded-xl border border-zinc-300 bg-white px-4 py-4 text-center text-sm font-semibold text-zinc-900 shadow-sm transition-colors hover:bg-zinc-100"
        >
          분실물/습득물 등록
        </Link>
        <Link
          href="/me"
          className="rounded-xl border border-zinc-300 bg-white px-4 py-4 text-center text-sm font-semibold text-zinc-900 shadow-sm transition-colors hover:bg-zinc-100"
        >
          내 정보 보기
        </Link>
      </section>

      <section className="mt-6 grid gap-3 sm:mt-8 sm:grid-cols-3">
        <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-zinc-500">STEP 1</p>
          <p className="mt-2 text-sm font-semibold text-zinc-900">게시글 등록</p>
          <p className="mt-1 text-xs leading-5 text-zinc-600">분실/습득 유형과 위치, 식별 정보를 등록합니다.</p>
        </article>
        <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-zinc-500">STEP 2</p>
          <p className="mt-2 text-sm font-semibold text-zinc-900">매칭 진행</p>
          <p className="mt-1 text-xs leading-5 text-zinc-600">클레임 승인/거절과 1회 메시지로 실제 전달을 진행합니다.</p>
        </article>
        <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-zinc-500">STEP 3</p>
          <p className="mt-2 text-sm font-semibold text-zinc-900">운영 및 알림</p>
          <p className="mt-1 text-xs leading-5 text-zinc-600">알림함과 관리자 신고 처리로 운영 상태를 관리합니다.</p>
        </article>
      </section>
    </main>
  );
}
