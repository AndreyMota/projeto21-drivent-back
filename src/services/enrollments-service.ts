import { Address, Enrollment } from '@prisma/client';
import { request } from '@/utils/request';
import { notFoundError } from '@/errors';
import { addressRepository, CreateAddressParams, enrollmentRepository, CreateEnrollmentParams } from '@/repositories';
import { exclude } from '@/utils/prisma-utils';
import { ApplicationError } from '@/protocols';
import axios from 'axios';

// TODO - Receber o CEP por parâmetro nesta função.

async function getAddressFromCEP(cep: string) {
  // Verificar se o CEP possui exatamente 7 dígitos numéricos
  if (!/^\d{8}$/.test(cep)) {
    const error: ApplicationError = {
      name: 'InvalidDataError',
      message: 'CEP must have 8 numeric digits.',
    };
    throw error;
  }

  // Chamada à API do ViaCEP
  try {
    const result = await request.get(`${process.env.VIA_CEP_API}/${cep}/json/`);
    console.log(result);

    // Verificar se a resposta contém erro do ViaCEP
    if (result.data.erro === true) {
      const error: ApplicationError = {
        name: 'InvalidDataError',
        message: 'Invalid CEP or CEP not found.',
      };
      throw error;
    }

    // Mapear os dados de resposta desejados
    return {
      logradouro: result.data.logradouro,
      complemento: result.data.complemento,
      bairro: result.data.bairro,
      cidade: result.data.localidade,
      uf: result.data.uf,
    };
  } catch (error) {
    throw error;
  }
}


async function getOneWithAddressByUserId(userId: number): Promise<GetOneWithAddressByUserIdResult> {
  const enrollmentWithAddress = await enrollmentRepository.findWithAddressByUserId(userId);

  if (!enrollmentWithAddress) throw notFoundError();

  const [firstAddress] = enrollmentWithAddress.Address;
  const address = getFirstAddress(firstAddress);

  return {
    ...exclude(enrollmentWithAddress, 'userId', 'createdAt', 'updatedAt', 'Address'),
    ...(!!address && { address }),
  };
}

type GetOneWithAddressByUserIdResult = Omit<Enrollment, 'userId' | 'createdAt' | 'updatedAt'>;

function getFirstAddress(firstAddress: Address): GetAddressResult {
  if (!firstAddress) return null;

  return exclude(firstAddress, 'createdAt', 'updatedAt', 'enrollmentId');
}

type GetAddressResult = Omit<Address, 'createdAt' | 'updatedAt' | 'enrollmentId'>;

async function createOrUpdateEnrollmentWithAddress(params: CreateOrUpdateEnrollmentWithAddress) {
  const enrollment = exclude(params, 'address');
  enrollment.birthday = new Date(enrollment.birthday);
  const address = getAddressForUpsert(params.address);

  // TODO - Verificar se o CEP é válido antes de associar ao enrollment.
  await getAddressFromCEP(address.cep);

  const newEnrollment = await enrollmentRepository.upsert(params.userId, enrollment, exclude(enrollment, 'userId'));

  await addressRepository.upsert(newEnrollment.id, address, address);
}

function getAddressForUpsert(address: CreateAddressParams) {
  return {
    ...address,
    ...(address?.addressDetail && { addressDetail: address.addressDetail }),
  };
}

export type CreateOrUpdateEnrollmentWithAddress = CreateEnrollmentParams & {
  address: CreateAddressParams;
};

export const enrollmentsService = {
  getOneWithAddressByUserId,
  createOrUpdateEnrollmentWithAddress,
  getAddressFromCEP,
};
