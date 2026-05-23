import { Phone, MessageCircle, Mail, MapPin, ExternalLink } from 'lucide-react';
import { PageHeader } from '../components/ui';

function ContactCard({ icon: Icon, label, value, href, color }) {
  return (
    <a
      href={href}
      target={href?.startsWith('http') ? '_blank' : undefined}
      rel="noopener noreferrer"
      className={`flex items-center gap-4 p-4 rounded-xl border bg-white dark:bg-slate-800
        border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition group
        ${href ? 'cursor-pointer' : 'cursor-default'}`}
    >
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-0.5">{label}</p>
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{value}</p>
      </div>
      {href && (
        <ExternalLink size={14} className="ml-auto shrink-0 text-slate-300 group-hover:text-blue-500 transition" />
      )}
    </a>
  );
}

export default function ContactPage() {
  return (
    <div className="max-w-lg mx-auto px-4 py-10">
      <PageHeader
        icon={Phone}
        title="Contact Us"
        subtitle="Reach the SkuliNode support team"
      />

      <div className="space-y-3 mt-6">
        <ContactCard
          icon={Phone}
          label="Phone"
          value="0752 303 770"
          href="tel:+255752303770"
          color="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
        />
        <ContactCard
          icon={MessageCircle}
          label="WhatsApp"
          value="+255 712 750 468"
          href="https://wa.me/255712750468"
          color="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
        />
        <ContactCard
          icon={Mail}
          label="Email"
          value="support@skulinode.com"
          href="mailto:support@skulinode.com"
          color="bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400"
        />
      </div>

      <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl px-5 py-4 text-sm text-blue-700 dark:text-blue-300">
        <p className="font-semibold mb-1">Support hours</p>
        <p className="text-blue-600 dark:text-blue-400">Monday – Friday &nbsp;·&nbsp; 8 AM – 5 PM (EAT)</p>
        <p className="mt-2">For fastest response, WhatsApp is preferred during business hours.</p>
      </div>
    </div>
  );
}
