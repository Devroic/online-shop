import { Truck, ShieldCheck, RotateCcw, Headphones } from 'lucide-react';
import { t } from './i18n.js';

/**
 * The four boxes under the banner on the home page. Each can be hidden or given
 * its own wording in Admin → Pages → Home; left empty, the defaults below show
 * (the delivery text follows the courier's description, the help text the shop's
 * email, or its phone), so they never promise something the shop has not set up.
 */
export const PERKS = [
  {
    key: 'delivery',
    icon: Truck,
    title: () => t('Fast delivery'),
    text: (settings) =>
      settings.deliveryNote === 'pickup' ? t('Store pickup') : settings.deliveryNote || t('Shipped within 1-3 business days'),
  },
  { key: 'secure', icon: ShieldCheck, title: () => t('Secure shopping'), text: () => t('Your data is protected') },
  { key: 'returns', icon: RotateCcw, title: () => t('Easy returns'), text: () => t('14 days to change your mind') },
  {
    key: 'help',
    icon: Headphones,
    title: () => t('Here to help'),
    text: (settings) => settings.contact.email || settings.contact.phone || t('Contact us anytime'),
  },
];

/** The boxes to show, with their final title and text. */
export const shownPerks = (settings) =>
  PERKS.filter((p) => settings.perks?.[p.key]?.show !== false).map((p) => ({
    ...p,
    title: settings.perks?.[p.key]?.title || p.title(settings),
    text: settings.perks?.[p.key]?.text || p.text(settings),
  }));
