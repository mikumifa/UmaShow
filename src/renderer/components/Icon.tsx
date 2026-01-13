import { FC } from 'react';

interface IconProps {
  size?: number;
  className?: string;
}

export default function createImageIcon(src: string): FC<IconProps> {
  // eslint-disable-next-line react/function-component-definition
  const ImageIcon: FC<IconProps> = ({ size = 24, className }) => (
    <img
      src={src}
      alt=""
      className={`${className ?? ''} object-contain`}
      style={{ width: size, height: size }}
    />
  );
  return ImageIcon;
}
