import type { SaveAdminPlanBody } from '@notefinder/contracts';
import type { Resolver } from 'react-hook-form';

export const planFormResolver: Resolver<SaveAdminPlanBody> = async (
  values,
  context,
  options,
) => {
  const [{ zodResolver }, { saveAdminPlanBodySchema }] = await Promise.all([
    import('@hookform/resolvers/zod'),
    import('@notefinder/contracts'),
  ]);
  return zodResolver(saveAdminPlanBodySchema)(values, context, options);
};
