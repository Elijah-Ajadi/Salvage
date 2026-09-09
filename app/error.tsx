'use client';
export default function ErrorPage({reset}:{reset:()=>void}){return <main className="reset-page"><h1>We couldn’t load Salvage.</h1><p>The account or database connection may be unavailable. Please try again shortly.</p><button className="primary" onClick={reset}>Try again</button><a href="/login">Back to login</a></main>;}
