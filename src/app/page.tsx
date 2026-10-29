import Link from 'next/link';

export default function Home() {
  return (
    <main className="db-welcome">
      <div className="db-welcome-photo" role="img" aria-label="A woman managing her shop using her phone" />
      <div className="db-welcome-shade" />
      <header className="db-welcome-brand">
        <Link href="/" aria-label="DigiBiashara home">
          <img src="/digibiashara-logo.svg" alt="DigiBiashara" />
        </Link>
      </header>
      <div className="db-welcome-action">
        <Link href="/login" className="db-welcome-button">Get Started <span aria-hidden="true">→</span></Link>
      </div>
      <div className="db-welcome-bottom" aria-hidden="true"><span /> <span /> <span /></div>
    </main>
  );
}
