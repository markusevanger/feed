"use client"

import { useWindupString } from "windups";

interface WindupProps {
    text: string;
}

const Windup = ({ text }: WindupProps) => {
    const [animatedText] = useWindupString(text);
    return <div>{animatedText}</div>;
};

export default Windup;