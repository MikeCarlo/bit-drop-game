import { EntrypointHeight, reddit } from '@devvit/web/server';

export const createPost = async () => {
  return await reddit.submitCustomPost({
    title: 'BIT·DROP — match 4, clear the targets',
    entry: 'default',
    styles: {
      backgroundColor: '#1C1C1EFF',
      backgroundColorDark: '#1C1C1EFF',
      height: EntrypointHeight.TALL,
    },
  });
};
