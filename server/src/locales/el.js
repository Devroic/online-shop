// Greek translations for server-side texts. Keys are the English texts used
// in the code (emails, default pages and shipping methods, demo data).

const strings = {
  // Order statuses
  Pending: 'Σε αναμονή',
  Processing: 'Σε επεξεργασία',
  Shipped: 'Απεστάλη',
  Delivered: 'Παραδόθηκε',
  Cancelled: 'Ακυρώθηκε',

  // Emails
  Subtotal: 'Υποσύνολο',
  Discount: 'Έκπτωση',
  Shipping: 'Αποστολή',
  'Payment fee': 'Χρέωση πληρωμής',
  Total: 'Σύνολο',
  Payment: 'Πληρωμή',
  'Bank transfer details': 'Στοιχεία τραπεζικής κατάθεσης',
  Reference: 'Αιτιολογία',
  'Thank you for your order!': 'Ευχαριστούμε για την παραγγελία σας!',
  'Hi {name},': 'Γεια σας {name},',
  'we have received your order {number}.': 'λάβαμε την παραγγελία σας {number}.',
  'View order': 'Προβολή παραγγελίας',
  'Order confirmation': 'Επιβεβαίωση παραγγελίας',
  'New order': 'Νέα παραγγελία',
  'Open in admin': 'Άνοιγμα στη διαχείριση',
  'Tracking number': 'Αριθμός αποστολής',
  'Order update': 'Ενημέρωση παραγγελίας',
  'Your order status is now': 'Η κατάσταση της παραγγελίας σας είναι τώρα',
  'We received a request to reset your password.': 'Λάβαμε αίτημα επαναφοράς κωδικού.',
  'Choose a new password': 'Ορισμός νέου κωδικού',
  'The link expires in 1 hour. If you did not ask for this, ignore this email.':
    'Ο σύνδεσμος λήγει σε 1 ώρα. Αν δεν το ζητήσατε εσείς, αγνοήστε αυτό το email.',
  'Password reset': 'Επαναφορά κωδικού',
  'Contact form': 'Φόρμα επικοινωνίας',
  'Welcome, {name}!': 'Καλώς ήρθατε, {name}!',
  'Your account at {store} is ready.': 'Ο λογαριασμός σας στο {store} δημιουργήθηκε.',
  'From your account you can follow your orders and save your address for faster checkout.':
    'Από τον λογαριασμό σας μπορείτε να βλέπετε τις παραγγελίες σας και να αποθηκεύσετε τη διεύθυνσή σας για γρηγορότερες αγορές.',
  'Start shopping': 'Ξεκινήστε τις αγορές',
  'Welcome to {store}': 'Καλώς ήρθατε στο {store}',

  // Default pages
  'About us': 'Σχετικά με εμάς',
  '## Who we are\n\nTell your story here: what makes the shop special and why people should buy from you.':
    '## Ποιοι είμαστε\n\nΓράψτε εδώ την ιστορία του καταστήματος, τι σας κάνει ξεχωριστούς και γιατί να ψωνίσει κάποιος από εσάς.',
  'Shipping & Returns': 'Αποστολές & Επιστροφές',
  '## Shipping\n\nOrders ship within 1-3 business days.\n\n## Returns\n\nYou can return a product within 14 days of delivery.':
    '## Αποστολές\n\nΟι παραγγελίες αποστέλλονται εντός 1-3 εργάσιμων ημερών.\n\n## Επιστροφές\n\nΜπορείτε να επιστρέψετε ένα προϊόν εντός 14 ημερών από την παραλαβή.',
  'Terms & Conditions': 'Όροι χρήσης',
  '## Terms & Conditions\n\nFill in your terms (company details, VAT number, payment methods, right of withdrawal, etc.).':
    '## Όροι χρήσης\n\nΣυμπληρώστε τους όρους χρήσης του καταστήματος (στοιχεία επιχείρησης, ΑΦΜ, τρόποι πληρωμής, δικαίωμα υπαναχώρησης κ.λπ.).',
  'Privacy Policy': 'Πολιτική απορρήτου',
  '## Privacy Policy\n\nDescribe what personal data you collect, why, and how customers can exercise their rights (GDPR).':
    '## Πολιτική απορρήτου\n\nΠεριγράψτε ποια προσωπικά δεδομένα συλλέγετε, για ποιο σκοπό και πώς μπορεί ο πελάτης να ασκήσει τα δικαιώματά του (GDPR).',

  // Default shipping methods
  'Delivery in 1-3 business days': 'Παράδοση σε 1-3 εργάσιμες',
  'Store pickup': 'Παραλαβή από το κατάστημα',
  Free: 'Χωρίς χρέωση',

  // Demo data (npm run seed)
  'Beautiful things for every day': 'Όμορφα πράγματα για κάθε μέρα',
  'Free shipping on orders over 50€ · Code WELCOME10 for -10%': 'Δωρεάν αποστολή για παραγγελίες άνω των 50€ · Κωδικός WELCOME10 για -10%',
  'The new collection is here': 'Η νέα συλλογή έφτασε',
  'Quality products, carefully selected. Fast delivery nationwide.': 'Ποιοτικά προϊόντα, προσεκτικά επιλεγμένα. Γρήγορη αποστολή σε όλη την Ελλάδα.',
  'Shop the products': 'Δείτε τα προϊόντα',
  '1 Example Street, Athens': 'Οδός Παραδείγματος 1, Αθήνα',
  'Mon-Fri 9:00-17:00': 'Δευ-Παρ 9:00-17:00',
  'Bank: Demo Bank\nIBAN: GR00 0000 0000 0000 0000 0000 000\nAccount holder: Demo Store':
    'Τράπεζα: Demo Bank\nIBAN: GR00 0000 0000 0000 0000 0000 000\nΔικαιούχος: Demo Store',
  Clothing: 'Ρούχα',
  'Comfortable, quality clothes for every day.': 'Άνετα και ποιοτικά ρούχα για κάθε μέρα.',
  Accessories: 'Αξεσουάρ',
  'Bags, hats and the small details that make a difference.': 'Τσάντες, καπέλα και μικρές λεπτομέρειες που κάνουν τη διαφορά.',
  Home: 'Σπίτι',
  'Things that make a home feel warmer.': 'Αντικείμενα που κάνουν το σπίτι πιο ζεστό.',
  Gifts: 'Δώρα',
  'Gift ideas for everyone.': 'Ιδέες για δώρα για όλους.',
  'Cotton T-shirt': 'Βαμβακερό T-shirt',
  'Soft t-shirt made of 100% organic cotton. A classic fit that goes with everything.':
    'Μαλακό t-shirt από 100% οργανικό βαμβάκι. Κλασική γραμμή που ταιριάζει με τα πάντα.',
  'Hooded sweatshirt': 'Φούτερ με κουκούλα',
  'Warm sweatshirt with fleece lining and a large kangaroo pocket.': 'Ζεστό φούτερ με εσωτερικό fleece και μεγάλη τσέπη καγκουρό.',
  'Linen shirt': 'Λινό πουκάμισο',
  'Cool linen shirt, perfect for summer.': 'Δροσερό λινό πουκάμισο, ιδανικό για το καλοκαίρι.',
  Jeans: 'Τζιν παντελόνι',
  'Straight fit jeans made of durable denim.': 'Straight fit τζιν από ανθεκτικό denim.',
  'Canvas tote bag': 'Πάνινη τσάντα',
  'Sturdy tote bag for shopping, the beach and everyday use.': 'Ανθεκτική tote bag για ψώνια, παραλία και καθημερινή χρήση.',
  'Baseball cap': 'Καπέλο jockey',
  'Adjustable cotton cap.': 'Ρυθμιζόμενο καπέλο από βαμβάκι.',
  'Leather wallet': 'Δερμάτινο πορτοφόλι',
  'Slim genuine leather wallet with 6 card slots.': 'Λεπτό πορτοφόλι από γνήσιο δέρμα με θήκες για 6 κάρτες.',
  'Ceramic mug': 'Κεραμική κούπα',
  'Handmade 350ml mug. Dishwasher safe.': 'Χειροποίητη κούπα 350ml. Κατάλληλη για πλυντήριο πιάτων.',
  'Scented candle': 'Αρωματικό κερί',
  Lavender: 'Λεβάντα',
  Vanilla: 'Βανίλια',
  Sandalwood: 'Σανδαλόξυλο',
  'Soy wax candle with a 40-hour burn time.': 'Κερί σόγιας με διάρκεια καύσης 40 ωρών.',
  'Cotton throw': 'Βαμβακερή κουβέρτα',
  'Lightweight sofa throw, 130x170cm.': 'Ελαφριά κουβέρτα για τον καναπέ, 130x170cm.',
  'Gift card': 'Κάρτα δώρου',
  'Let them choose! The card is sent by email.': 'Δώστε την επιλογή! Η κάρτα αποστέλλεται με email.',
  'Relax gift set': 'Σετ δώρου Relax',
  'Candle, mug and herbal tea in a beautiful gift box.': 'Κερί, κούπα και τσάι βοτάνων σε όμορφο κουτί δώρου.',
};

// Greek → Latin for URL slugs ("Κεραμική κούπα" → "keramiki-koupa").
const LETTERS = {
  α: 'a', ά: 'a', β: 'v', γ: 'g', δ: 'd', ε: 'e', έ: 'e', ζ: 'z', η: 'i', ή: 'i',
  θ: 'th', ι: 'i', ί: 'i', ϊ: 'i', ΐ: 'i', κ: 'k', λ: 'l', μ: 'm', ν: 'n', ξ: 'x',
  ο: 'o', ό: 'o', π: 'p', ρ: 'r', σ: 's', ς: 's', τ: 't', υ: 'y', ύ: 'y', ϋ: 'y',
  ΰ: 'y', φ: 'f', χ: 'ch', ψ: 'ps', ω: 'o', ώ: 'o',
};

/** Expects lowercase text. */
function transliterate(text) {
  return text
    .replace(/ο[υύ]/g, 'ou')
    .replace(/([αε])[υύ]/g, (_, v) => `${LETTERS[v]}v`)
    .replace(/[Ͱ-Ͽἀ-῿]/g, (ch) => LETTERS[ch] ?? '');
}

export default { strings, transliterate };
