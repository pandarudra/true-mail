import Image from "next/image";
import { Moirai_One } from "next/font/google";

const moiraiOne = Moirai_One({ weight: "400", subsets: ["latin"] });

export function BrandMark({
  className = "",
  light = false,
}: {
  className?: string;
  light?: boolean;
}) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Image
        src="/icon.png"
        alt=""
        width={28}
        height={28}
        className="h-7 w-7 rounded-lg"
      />
      <span
        className={`${moiraiOne.className} text-lg font-bold ${light ? "text-white" : "text-foreground"}`}
        style={{ WebkitTextStroke: light ? "0.5px white" : "0.5px currentColor" }}
      >
        TrueMail
      </span>
    </div>
  );
}
