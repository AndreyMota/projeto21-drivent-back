import { Response } from 'express';
import httpStatus from 'http-status';
import { AuthenticatedRequest } from '@/middlewares';
import { enrollmentsService } from '@/services';

export async function getEnrollmentByUser(req: AuthenticatedRequest, res: Response) {
  const { userId } = req;

  const enrollmentWithAddress = await enrollmentsService.getOneWithAddressByUserId(userId);

  return res.status(httpStatus.OK).send(enrollmentWithAddress);
}

export async function postCreateOrUpdateEnrollment(req: AuthenticatedRequest, res: Response) {
  await enrollmentsService.createOrUpdateEnrollmentWithAddress({
    ...req.body,
    userId: req.userId,
  });

  return res.sendStatus(httpStatus.OK);
}

export async function getAddressFromCEP(req: AuthenticatedRequest, res: Response) {
  const rawCep = req.query.cep;
  //O valor já é uma string
  const cep = rawCep as string;
  const address = await enrollmentsService.getAddressFromCEP(cep);
  res.status(httpStatus.OK).send(address);
}
