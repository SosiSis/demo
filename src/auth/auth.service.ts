import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { LoginDto } from './dto/login.dto';
import { SignUpDto } from './dto/signup.dto';
import { user } from './schemas/user.schema';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel('user')
    private userModel: Model<user>,
    private jwtService: JwtService,
  ) {}

  async signUp(signUpDto: SignUpDto): Promise<{ token: string }> {
    const { email, password } = signUpDto;

    let roles = ['user']; // Default role

    // Check if the credentials match the admin credentials
    if (email === process.env.ADMIN_EMAIL) {
      const isPasswordMatched = await bcrypt.compare(
        password,
        process.env.ADMIN_PASSWORD_HASH,
      );
      if (isPasswordMatched) {
        roles = ['admin']; // Assign admin role
      } else {
        throw new UnauthorizedException('Invalid credentials for admin signup.');
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await this.userModel.create({
      ...signUpDto,
      password: hashedPassword,
      roles,
    });

    const token = this.jwtService.sign(
      { id: newUser._id, roles: newUser.roles },
      { secret: process.env.JWT_SECRET },
    );

    return { token };
  }

  async login(loginDto: LoginDto): Promise<{ token: string }> {
    const { email, password } = loginDto;

    // Check if the user is the admin
    if (email === process.env.ADMIN_EMAIL) {
      const adminUser = await this.userModel.findOne({ email }).exec();
      if (!adminUser) {
        throw new UnauthorizedException('Admin user does not exist in the database.');
      }
    console.log(process.env.ADMIN_PASSWORD_HASH,password)
    
      const isPasswordMatched = await bcrypt.compare(
        password,
        process.env.ADMIN_PASSWORD_HASH,
      );

      if (!isPasswordMatched) {
        throw new UnauthorizedException('Invalid email or password.');
      }

      const adminToken = this.jwtService.sign(
        { id: adminUser._id, roles: adminUser.roles },
        { secret: process.env.JWT_SECRET },
      );

      return { token: adminToken };
    }

    // Handle regular user login
    const user = await this.userModel.findOne({ email }).exec();
    if (!user) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const isPasswordMatched = await bcrypt.compare(password, user.password);
    if (!isPasswordMatched) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const token = this.jwtService.sign(
      { id: user._id, roles: user.roles },
      { secret: process.env.JWT_SECRET },
    );

    return { token };
  }
}