// src/components/landing/Navbar.tsx
'use client';
import Link from 'next/link';
import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/nextjs';

export default function Navbar() {
  return (
    <nav className="navbar navbar-expand-lg navbar-light bg-white shadow-sm">
      <div className="container">
        <Link href="/" className="navbar-brand fw-bold text-primary">
          <span className="me-2">📬</span>AI Email Client
        </Link>
        <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
          <span className="navbar-toggler-icon"></span>
        </button>
        <div className="collapse navbar-collapse" id="navbarNav">
        <ul className="navbar-nav me-auto">
  <li className="nav-item">
    <Link href="#fonctionnalites" className="nav-link">Fonctionnalités</Link>
  </li>
  <li className="nav-item">
    <Link href="#tarifs" className="nav-link">Tarifs</Link>
  </li>
  <li className="nav-item">
    <Link href="#faq" className="nav-link">FAQ</Link>
  </li>
</ul>
          <div className="d-flex">
            <SignedIn>
              <UserButton afterSignOutUrl="/" />
            </SignedIn>
            <SignedOut>
              <SignInButton mode="modal">
                <button className="btn btn-outline-primary me-2">Connexion</button>
              </SignInButton>
              <SignInButton mode="modal" signUpFallbackRedirectUrl="/emails">
  <button className="btn btn-primary">Inscription</button>
</SignInButton>
            </SignedOut>
          </div>
        </div>
      </div>
    </nav>
  );
}
