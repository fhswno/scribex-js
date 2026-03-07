// TYPESCRIPT
type Props = {
  title: string;
  description: string;
};

const FeatureCard = ({ title, description }: Props) => {
  return (
    <div className="rounded-lg border border-fd-border bg-fd-card p-5">
      <h3 className="mb-1.5 text-sm font-medium text-fd-foreground">{title}</h3>
      <p className="text-sm text-fd-muted-foreground">{description}</p>
    </div>
  );
};

export default FeatureCard;
