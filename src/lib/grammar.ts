/** "a" or "an" for the given word, based on whether it starts with a vowel sound. A simple leading-vowel-letter heuristic — good enough for the plain category names ("probate lawyer", "estate sale provider") this is used for. */
export function articleFor(word: string): "a" | "an" {
  return /^[aeiou]/i.test(word) ? "an" : "a";
}
