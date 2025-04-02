// src/components/landing/Footer.tsx
'use client';
import Link from "next/link";

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-dark text-white py-5">
      <div className="container">
        <div className="text-center">
          <h5 className="fw-bold mb-3">📬 AI Email Client</h5>
          <p>Votre assistant IA pour une gestion d'emails plus intelligente.</p>
          <div className="d-flex justify-content-center gap-3 my-3">
            <a href="#" className="text-white"><i className="bi bi-twitter"></i></a>
            <a href="#" className="text-white"><i className="bi bi-linkedin"></i></a>
            <a href="#" className="text-white"><i className="bi bi-facebook"></i></a>
          </div>
          <p className="small text-white-50">
            &copy; {year} AI Email Client. Tous droits réservés.
            <br />
            <Link href="/privacy" className="text-white-50 me-2">Confidentialité</Link>
            <Link href="/terms" className="text-white-50 me-2">Conditions</Link>
            <Link href="/contact" className="text-white-50">Contact</Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
