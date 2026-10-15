import type { Faq } from "@/lib/faq";

export const HOME_TITLE =
  "Which credit card to use? The best card for every purchase · NorthTap";

export const HOME_DESCRIPTION =
  "Not sure which credit card to use? NorthTap shows which card in your wallet earns the most on each purchase, in dollars. Free for Canadian cardholders, no bank login.";

export const HOME_H1 = "The right card for every purchase.";

export const HOME_FAQS: Faq[] = [
  {
    question: "Which credit card should I use for each purchase?",
    answer:
      "The one that earns the most for that kind of purchase. Cards pay different rates on gas, groceries, restaurants and everything else, so the best card changes with what you buy. NorthTap compares the cards you carry and shows which one gives back the most, in dollars.",
  },
  {
    question: "Does NorthTap need my bank login?",
    answer:
      "No. You choose your cards from a list. NorthTap never asks for bank logins, card numbers or access to your accounts.",
  },
  {
    question: "Is NorthTap free?",
    answer:
      "Yes. NorthTap is free for Canadian cardholders, and you don't need an account to try it.",
  },
  {
    question: "How does NorthTap compare points and cash back?",
    answer:
      "It turns everything into dollars: each card's earn rate times an estimated value per point (cash back counts at face value). That way a 5× points card and a 4% cash back card compare directly.",
  },
];
