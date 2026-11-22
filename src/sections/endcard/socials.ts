/**
 * The links on the stamp, shown as icons. Paste a profile URL into `url` to make an icon live;
 * until then it shows dimmed and does nothing.
 */
export type Social = { id: 'instagram' | 'facebook' | 'linkedin' | 'behance' | 'email'; label: string; url: string }
export const SOCIALS: Social[] = [
  { id: 'instagram', label: 'Instagram', url: 'https://instagram.com/hiteshpalgreat' },
  { id: 'facebook', label: 'Facebook', url: 'https://facebook.com/hiteshpalgreat' },
  { id: 'linkedin', label: 'LinkedIn', url: 'https://linkedin.com/in/hiteshpalgreat' },
  { id: 'behance', label: 'Behance', url: 'https://www.behance.net/hiteshpalgreat' },
]
