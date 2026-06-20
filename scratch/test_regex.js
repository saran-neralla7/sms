const testStrings = [
  "Show that A=\\begin{pmatrix} a+ic & -b+id\\\\ b+id & a-ic \\end{pmatrix}, is unitary if and only if a^{2}+b^{2}+c^{2}+d^{2}=1",
  "Find the rank of the given matrix \\begin{pmatrix} 1 & 2 & 3 \\\\ 3 & 4 & 4 \\\\ 7 & 10 & 12 \\end{pmatrix}",
  "Calculate the wavelength associated with an electron raised to a potential 100 Volts.",
  "A quarter-wave plate is made of quartz (μₒ = 1.544, μₑ = 1.553) and is used for λ = 5893 Å. Calculate its minimum thickness.",
  "State Heisenberg's Uncertainty Principle and derive $\\Delta x \\cdot \\Delta p \\ge \\hbar / 2$."
];

function autoWrapMath(text) {
  // If the text already has delimiters, leave it alone
  if (text.includes("$")) return text;

  let processed = text;

  // 1. Wrap \begin{env} ... \end{env} (and optional non-space prefix like "A=") in $...$
  processed = processed.replace(/((?:[a-zA-Z0-9_\-+*\/=<>]+)?\\begin\{[a-zA-Z*]+\}.*?\\end\{[a-zA-Z*]+\})/gs, (_, match) => `$${match.trim()}$`);

  // 2. Wrap non-space segments containing ^ or _ in $...$
  processed = processed.replace(/(\S*[\^_]+\S*)/g, (_, match) => {
    // If it's already wrapped in $, don't wrap again
    if (match.startsWith("$") && match.endsWith("$")) return match;
    return `$${match}$`;
  });

  return processed;
}

testStrings.forEach((str, i) => {
  console.log(`\n--- Test ${i+1} ---`);
  console.log("Original :", str);
  console.log("Processed:", autoWrapMath(str));
});
