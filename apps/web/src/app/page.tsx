import Link from 'next/link';

const sections = [
  { href: '/classifications', title: 'Classifications', desc: 'Submit and review AI system risk classifications.' },
  { href: '/timeline', title: 'August 2026 readiness', desc: 'Portfolio-level deadline and obligation status.' },
  { href: '/regulations', title: 'Regulations', desc: 'Browse the EU AI Act obligation catalog and change log.' },
  { href: '/admin/rules', title: 'Admin · Rules', desc: 'Manage rule sets, templates, and policy overlays.' },
];

export default function HomePage() {
  return (
    <div>
      <h1 className="text-3xl font-semibold">EU AI Act Risk Classifier</h1>
      <p className="mt-2 text-gray-600">MVP workspace.</p>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {sections.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="block rounded-lg border border-gray-200 p-5 hover:border-gray-400"
          >
            <h2 className="text-lg font-medium">{s.title}</h2>
            <p className="mt-1 text-sm text-gray-600">{s.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
