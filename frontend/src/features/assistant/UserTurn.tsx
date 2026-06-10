export interface UserTurnProps {
  text: string;
}

export default function UserTurn({ text }: UserTurnProps) {
  return (
    <div className="mb-5 flex min-w-0 justify-end">
      <div className="max-w-[80%] rounded-xl rounded-br-sm bg-brand px-4 py-3 text-white shadow-sm">
        <p className="text-sm break-words whitespace-pre-wrap">{text}</p>
      </div>
    </div>
  );
}
