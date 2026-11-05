// Greek translations for server-side texts. Keys are the English texts used
// in the code (emails, default pages and shipping methods, demo data).

const strings = {
  // Order statuses
  Pending: 'Σε αναμονή',
  Processing: 'Σε επεξεργασία',
  Shipped: 'Απεστάλη',
  Delivered: 'Παραδόθηκε',
  Cancelled: 'Ακυρώθηκε',

  // Emails: shared parts
  Subtotal: 'Υποσύνολο',
  Discount: 'Έκπτωση',
  Shipping: 'Αποστολή',
  'Payment fee': 'Χρέωση πληρωμής',
  Total: 'Σύνολο',
  Payment: 'Πληρωμή',
  Reference: 'Αιτιολογία',
  'Hi {name},': 'Γεια σας {name},',
  'View order': 'Δείτε την παραγγελία',
  'Delivery address': 'Διεύθυνση παράδοσης',
  'Pickup from the store': 'Παραλαβή από το κατάστημα',
  'Tracking number': 'Αριθμός αποστολής',
  'You can use it on the courier website to see where your parcel is.':
    'Με αυτόν μπορείτε να δείτε πού βρίσκεται το δέμα σας στο site της εταιρείας courier.',
  'Press the button to see where your parcel is right now.': 'Πατήστε το κουμπί για να δείτε πού βρίσκεται αυτή τη στιγμή το δέμα σας.',
  'Track your parcel': 'Παρακολουθήστε το δέμα σας',
  'Follow the parcel of your order #{number}': 'Παρακολουθήστε το δέμα της παραγγελίας σας #{number}',
  'You can now follow the parcel of your order {number}.': 'Μπορείτε πλέον να παρακολουθείτε το δέμα της παραγγελίας σας {number}.',
  'We will email you again as soon as it ships.': 'Θα σας στείλουμε νέο email μόλις αποσταλεί.',
  'We will email you again as soon as it is ready for pickup.': 'Θα σας στείλουμε νέο email μόλις είναι έτοιμη για παραλαβή.',
  'We will keep you posted by email on its progress.': 'Θα σας ενημερώνουμε με email για την πορεία της.',
  'If you have any questions, just reply to this email.': 'Για οποιαδήποτε απορία, απλώς απαντήστε σε αυτό το email.',

  // Emails: new order (customer)
  'Thank you for your order!': 'Ευχαριστούμε για την παραγγελία σας!',
  'We received your order #{number}': 'Λάβαμε την παραγγελία σας #{number}',
  'We received your order {number}.': 'Λάβαμε την παραγγελία σας {number}.',
  'You will pay {total} at the store when you pick it up.': 'Θα πληρώσετε {total} στο κατάστημα, όταν την παραλάβετε.',
  'You will pay {total} in cash when you receive it.': 'Θα πληρώσετε {total} με αντικαταβολή, όταν την παραλάβετε.',
  'Your order is confirmed': 'Η παραγγελία σας επιβεβαιώθηκε',
  'Your order #{number} is confirmed': 'Η παραγγελία σας #{number} επιβεβαιώθηκε',
  'We received your payment and your order {number} is confirmed.': 'Λάβαμε την πληρωμή σας και η παραγγελία σας {number} επιβεβαιώθηκε.',

  // Emails: order updates (customer)
  'We are preparing your order': 'Ετοιμάζουμε την παραγγελία σας',
  'We are preparing your order #{number}': 'Ετοιμάζουμε την παραγγελία σας #{number}',
  'Your order {number} is confirmed and we are now preparing it.': 'Η παραγγελία σας {number} επιβεβαιώθηκε και ήδη την ετοιμάζουμε.',
  'Your order is on its way': 'Η παραγγελία σας είναι καθ’ οδόν',
  'Your order #{number} is on its way': 'Η παραγγελία σας #{number} στάλθηκε',
  'Good news: your order {number} has been sent with {courier} and is on its way to you.':
    'Καλά νέα! Η παραγγελία σας {number} στάλθηκε με {courier} και έρχεται προς εσάς.',
  'Please have {total} ready in cash for the courier.': 'Έχετε έτοιμο το ποσό των {total} για την αντικαταβολή.',
  'Your order is ready for pickup': 'Η παραγγελία σας είναι έτοιμη για παραλαβή',
  'Your order #{number} is ready for pickup': 'Η παραγγελία σας #{number} είναι έτοιμη για παραλαβή',
  'Your order {number} is ready and waiting for you at the store.': 'Η παραγγελία σας {number} είναι έτοιμη και σας περιμένει στο κατάστημα.',
  'The amount to pay at pickup is {total}.': 'Το ποσό που θα πληρώσετε κατά την παραλαβή είναι {total}.',
  'Thank you for shopping with us!': 'Σας ευχαριστούμε που ψωνίσατε από εμάς!',
  'Your order #{number} has been delivered': 'Η παραγγελία σας #{number} παραδόθηκε',
  'Your order {number} has been delivered.': 'Η παραγγελία σας {number} παραδόθηκε.',
  'We hope you enjoy your purchase! If anything is not right, just reply to this email and we will sort it out.':
    'Ελπίζουμε να μείνετε ικανοποιημένοι από την αγορά σας! Αν κάτι δεν είναι όπως το περιμένατε, απαντήστε σε αυτό το email και θα το φροντίσουμε.',
  'Your order has been cancelled': 'Η παραγγελία σας ακυρώθηκε',
  'Your order #{number} has been cancelled': 'Η παραγγελία σας #{number} ακυρώθηκε',
  'Your order {number} has been cancelled.': 'Η παραγγελία σας {number} ακυρώθηκε.',
  'The amount of {total} has been refunded to your card. Depending on your bank, it may take a few business days to show.':
    'Το ποσό των {total} επιστράφηκε στην κάρτα σας. Ανάλογα με την τράπεζά σας, μπορεί να χρειαστούν μερικές εργάσιμες μέχρι να εμφανιστεί.',
  'Since you have already paid, we will refund {total} to your card.': 'Επειδή έχετε ήδη πληρώσει, θα σας επιστρέψουμε το ποσό των {total} στην κάρτα σας.',
  'Your order is active again': 'Η παραγγελία σας είναι ξανά ενεργή',
  'Update on your order #{number}': 'Ενημέρωση για την παραγγελία σας #{number}',
  'Your order {number} is active again.': 'Η παραγγελία σας {number} είναι ξανά ενεργή.',
  'Track your order': 'Παρακολουθήστε την παραγγελία σας',
  'Tracking number for your order #{number}': 'Αριθμός αποστολής για την παραγγελία σας #{number}',
  'Here is the tracking number for your order {number}:': 'Ο αριθμός αποστολής για την παραγγελία σας {number} είναι:',

  // Emails: to the shop
  'New order': 'Νέα παραγγελία',
  Customer: 'Πελάτης',
  'Customer notes': 'Σχόλια πελάτη',
  'Card – paid': 'Κάρτα – πληρώθηκε',
  'Card – awaiting payment': 'Κάρτα – αναμένεται η πληρωμή',
  'Pay at the store – collect {total}': 'Πληρωμή στο κατάστημα – προς είσπραξη {total}',
  'Cash on delivery – collect {total}': 'Αντικαταβολή – προς είσπραξη {total}',
  'Open in admin': 'Άνοιγμα στη διαχείριση',
  'New message from the contact form': 'Νέο μήνυμα από τη φόρμα επικοινωνίας',
  'Reply to this email to answer {name} directly.': 'Απαντήστε σε αυτό το email και η απάντησή σας θα πάει απευθείας στον αποστολέα ({name}).',

  // Emails: account
  'Welcome, {name}!': 'Καλώς ήρθατε, {name}!',
  'Welcome to {store}': 'Καλώς ήρθατε στο {store}',
  'Your account at {store} is ready.': 'Ο λογαριασμός σας στο {store} είναι έτοιμος.',
  'From your account you can follow your orders and save your address for faster checkout.':
    'Από τον λογαριασμό σας μπορείτε να παρακολουθείτε τις παραγγελίες σας και να αποθηκεύσετε τη διεύθυνσή σας, ώστε οι επόμενες αγορές να γίνονται πιο γρήγορα.',
  'Start shopping': 'Δείτε τα προϊόντα μας',
  'Please confirm your email address, so we can link your earlier orders and keep your account safe.':
    'Για να ολοκληρωθεί η εγγραφή σας, επιβεβαιώστε το email σας. Έτσι προστατεύουμε τον λογαριασμό σας και συνδέουμε σε αυτόν όσες παραγγελίες έχετε ήδη κάνει με αυτό το email.',
  'Confirm my email': 'Επιβεβαιώνω το email μου',
  'The link expires in 7 days. If you did not create this account, ignore this email.':
    'Ο σύνδεσμος ισχύει για 7 ημέρες. Αν δεν δημιουργήσατε εσείς λογαριασμό, αγνοήστε αυτό το email.',
  'Confirm your email for {store}': 'Επιβεβαιώστε το email σας – {store}',
  'We received a request to change your password. Press the button below to choose a new one.':
    'Λάβαμε αίτημα για αλλαγή του κωδικού σας. Πατήστε το παρακάτω κουμπί για να ορίσετε νέο κωδικό.',
  'Choose a new password': 'Ορισμός νέου κωδικού',
  'The link expires in 1 hour. If you did not ask for this, ignore this email: your password will not change.':
    'Ο σύνδεσμος ισχύει για 1 ώρα. Αν δεν το ζητήσατε εσείς, αγνοήστε αυτό το email· ο κωδικός σας δεν θα αλλάξει.',
  'Change your password – {store}': 'Αλλαγή κωδικού – {store}',

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
  '2-7 business days': '2-7 εργάσιμες μέρες',
  Courier: 'Courier',
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
